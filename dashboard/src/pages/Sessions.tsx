
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDomain } from "../context/DomainContext";

interface SessionSummary {
    session_id: string;
    started: string;
    ended: string;
    event_count: string; // Postgres COUNT() return a string 
}

export function SessionsPage() {
    const { domain } = useDomain();
    const navigate = useNavigate();

    const { data: sessions, isLoading, error } = useQuery<SessionSummary[]>({
        queryKey: ['sessions', domain],
        queryFn: async () => {
            const res = await fetch(`/api/sessions?domain=${domain}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch sessions');
            return res.json();
        }
    })
    if (isLoading) return <div className="container flex-center">Loading sessions...</div>;
    if (error) return <div className="container">Error loading sessions!</div>;

    return (
        <div className="container"
            style={{ paddingBottom: '4rem' }}>
            <h1 style={{
                marginBottom: '2rem'
            }}>
                Recorded Sessions
            </h1>

            <div className="glass-card" style={{
                padding: '1rem',
                overflowX: 'auto'
            }}>
                <table style={{
                    width: '100%',
                    textAlign: 'left',
                    borderCollapse: 'collapse'
                }}>
                    <thead>
                        <tr style={{
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <th style={{
                                padding: '1rem'
                            }}>Session ID</th>
                            <th style={{
                                padding: '1rem'
                            }}>Started</th>
                            <th style={{
                                padding: '1rem'
                            }}>Event Captured</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions?.map((session) => (
                            <tr key={session.session_id} style={{
                                borderBottom: '1px solid var(--borer-subtle)',
                                cursor: 'pointer'
                            }}

                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                onClick={() => navigate(`/sessions/${session.session_id}`)}
                            >
                                <td style={{
                                    padding: '1rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--accent-primary)'
                                }}>
                                    {session.session_id.slice(0, 8)}...
                                </td>
                                <td style={{
                                    padding: '1rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {new Date(session.started).toLocaleString()}
                                </td>
                                <td style={{
                                    padding: '1rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {session.event_count} events
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

