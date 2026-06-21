import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDomain } from "../context/DomainContext";

interface ErrorGroup {
    message: string;
    stack: string | null;
    url: string | null;
    occurrences: string; // Postgress COUNT() return a string
    last_seen: string; // timestamp
}

export function ErrorLog() {
    const { domain } = useDomain();
    const [selectedError, setSelectedError] = useState<ErrorGroup | null>(null);

    const { data: errors, isLoading, error } = useQuery<ErrorGroup[]>({
        queryKey: ['error', domain],
        queryFn: async () => {
            const res = await fetch(`/api/errors?domain=${domain}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch errors')
            return res.json();
        }
    });

    if (isLoading) return <div className="container flex-center">Loading error logs...</div>;
    if (error) return <div className="container">Error loading error logs!</div>;

    return (
        <div className="container" style={{
            paddingBottom: '4rem'
        }}>
            <h1 style={{ marginBottom: '2rem' }}>Error Logs</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Grouped by unique error message across all sessions.
            </p>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            backgroundColor: 'rgba(255,255,255,0.02)'
                        }}>
                            <th style={{ padding: '1rem' }}>Message</th>
                            <th style={{ padding: '1rem' }}>Occurrences</th>
                            <th style={{ padding: '1rem' }}>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {errors?.map((err, index) => (
                            <tr key={index}
                                onClick={() => setSelectedError(err)}
                                style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,68,68,0.05)'}

                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ padding: '1rem', color: 'var(--status-critical)', fontWeight: 'bold' }}>{err.message}</td>
                                <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)' }}>
                                    {err.occurrences}
                                </td>
                                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                    {new Date(err.last_seen).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {errors?.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No errors logged yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/** Error Detail Modal */}
            {selectedError && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}
                    onClick={() => setSelectedError(null)}>
                    <div className="glass-card"
                        style={{
                            maxWidth: '800px',
                            width: '100%',
                            padding: '2rem',
                            position: 'relative'
                        }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedError(null)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '1.5rem'
                            }}>
                            &times;
                        </button>
                        <h2 style={{
                            color: 'var(--status-critical)',
                            marginBottom: '1rem'
                        }}>
                            Error Details
                        </h2>
                        <div style={{
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem'
                            }}>Message</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                padding: '0.5rem', background: 'rgba(255,0,0,0.1)', borderRadius: '4px', border: '1px solid var(--status-critical)'
                            }}>
                                {selectedError.message}
                            </div>
                        </div>
                        <div style={{
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem'
                            }}>Occurrences</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem' }}>
                                {selectedError.occurrences}
                            </div>
                        </div>
                        {selectedError.url && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Latest URL</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                                    {selectedError.url}
                                </div>
                            </div>
                        )}
                        {selectedError.stack && (
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Latest Stack Trace</div>
                                <pre style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.875rem',
                                    padding: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {selectedError.stack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}