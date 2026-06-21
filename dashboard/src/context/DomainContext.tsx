// We create React Context for domain globally
import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

export interface Project {
    id: string;
    name: string;
    domain: string;
}

interface DomainContextType {
    domain: string;
    setDomain: (domain: string) => void;
    projects: Project[];
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

export function DomainProvider({
    children
}: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [domain, setDomain] = useState<string>(window.location.hostname);

    const { data: projects } = useQuery<Project[]>({
        queryKey: ['projects', user?.id],
        queryFn: async () => {
            const res = await fetch('/api/projects', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch projects');
            return res.json();
        },
        enabled: !!user
    });

    useEffect(() => {
        // Auto-select the first project domain when projects load if currently on the demo domain
        if (projects && projects.length > 0 && domain === window.location.hostname) {
            setDomain(projects[0].domain);
        }
        
        // If user logs out, revert back to the dynamic Demo domain (Frictionless Demo)
        if (!user) {
            setDomain(window.location.hostname);
        }
    }, [projects, user]);

    return (
        <DomainContext.Provider value={{ domain, setDomain, projects: projects || [] }}>
            {children}
        </DomainContext.Provider>
    );
}

export function useDomain() {
    const context = useContext(DomainContext);
    if (!context) {
        throw new Error('useDomain must be used within DomainProvider');
    }
    return context;
}