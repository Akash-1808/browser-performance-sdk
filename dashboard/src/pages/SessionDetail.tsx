import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReplayPlayer } from "../components/ReplayPlayer";

interface SessionEvent {
    metric: string;
    time: string;
    value?: number;
    meta?: any;
}

interface SessionDetailProps {
    sessionId: string;
    onBack: () => void;
}

export function SessionDetail({
    sessionId, onBack
}: SessionDetailProps) {
    const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null);

    const { data: events, isLoading, error } = useQuery<SessionEvent[]>({
        queryKey: ['session', sessionId],
        queryFn: async () => {
            const res = await fetch(`/api/sessions/${sessionId}`);
            if (!res.ok) throw new Error('Failed to fetch session details');
            const rawEvents = await res.json();

            // Postgres sometimes returns jsonb as a string depending on the driver config
            // We need to parse it here so both the timeline and the modal have access to a real object
            return rawEvents.map((ev: any) => ({
                ...ev,
                meta: typeof ev.meta === 'string' ? JSON.parse(ev.meta) : ev.meta
            }));
        }
    });

    if (isLoading) return <div className="container flex-center">Loading session timeline...</div>

    if (error) return <div className="container">Error loading timeline!</div>

    // Filter out only the mutation events, and extract their "meta" payload
    const mutationEvents = events
        ?.filter(e => e.metric === 'mutation' && e.meta)
        ?.map(e => e.meta) || [];

    return (
        <div className="container" style={{
            paddingBottom: '4rem'
        }}>
            <button onClick={onBack}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginBottom: '2rem'
                }}>
                &larr; Back to Sessions
            </button>
            <h1 style={{
                marginBottom: '2rem'
            }}>
                Session Timeline
            </h1>
            <p style={{
                color: 'var(--text-muted)',
                marginBottom: '2rem',
                fontFamily: 'var(--font-mono)'
            }}>
                ID: {sessionId}
            </p>
            <div style={{ display: 'flex', gap: '2rem', height: '600px' }}>
                {/* Left Side: The Replay Player */}
                <div style={{ flex: 1 }}>
                    <ReplayPlayer mutations={mutationEvents} />
                </div>

                {/* Right Side: Timeline */}
                <div className="glass-card"
                    style={{
                        flex: 1,
                        padding: '2rem',
                        overflowY: 'auto'
                    }}>
                    {
                        events?.map((event, index) => {
                        const isError = event.metric === 'error';
                        const isMutation = event.metric === 'mutation';
                        const meta = event.meta;

                        return (<div key={index}
                            onClick={() => (isError || isMutation) && setSelectedEvent(event)}
                            style={{
                                display: 'flex',
                                gap: '1rem',
                                borderBottom: '1px solid var(--border-subtle)',
                                padding: '1rem',
                                cursor: (isError || isMutation) ? 'pointer' : 'default',
                                transition: 'background-color 0.2s',
                                backgroundColor: isError ? 'rgba(255, 68, 68, 0.05)' : isMutation ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                margin: '0 -1rem',
                                borderRadius: '4px'
                            }}
                            onMouseEnter={(e) => {
                                if (isError) e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
                                if (isMutation) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                if (isError) e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.05)';
                                if (isMutation) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            }}>
                            <div style={{
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.875rem',
                                width: '100px'
                            }}>
                                {new Date(event.time).toLocaleTimeString()}
                            </div>
                            <div>
                                <span style={{
                                    display: 'inline-block',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: isError ? 'rgba(255,68,68,0.2)' : isMutation ? 'rgba(255,255,255,0.1)' : 'rgba(0,255,136,0.2)',
                                    color: isError ? 'var(--status-critical)' : isMutation ? 'var(--text-primary)' : 'var(--status-good)',
                                    marginBottom: '0.5rem'
                                }}>
                                    {event.metric}
                                </span>
                                <div style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.875rem'
                                }}>
                                    {isError && event.meta?.message}
                                    {isMutation && `Target: ${meta?.target || 'unknown'} (+${Array.isArray(meta?.added) ? meta.added.length : 0} / -${Array.isArray(meta?.removed) ? meta.removed.length : 0})`}
                                    {!isError && !isMutation && `Value: ${event.value !== null ? Number(event.value).toFixed(2) : 'N/A'}`}
                                </div>
                            </div>
                        </div>)
                    })
                }
                </div>
            </div>

            {/* Error / Mutation Details Modal */}
            {selectedEvent && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }} onClick={() => setSelectedEvent(null)}>
                    <div className='glass-card' style={{
                        maxWidth: '600px',
                        width: '100%',
                        padding: '2rem',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedEvent(null)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '1.5rem'
                            }}
                        >&times;</button>
                        <h2 style={{
                            color: selectedEvent.metric === 'error' ? 'var(--status-critical)' : 'var(--text-primary)',
                            marginBottom: '1rem',
                            textTransform: 'capitalize'
                        }}>{selectedEvent.metric} Details</h2>

                        {selectedEvent.metric === 'error' && (
                            <>
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Message</div>
                                    <div style={{ fontFamily: 'var(--font-mono)', padding: '0.5rem', background: 'rgba(255,0,0,0.1)', borderRadius: '4px', border: '1px solid var(--status-critical)' }}>
                                        {selectedEvent.meta?.message}
                                    </div>
                                </div>

                                {selectedEvent.meta?.url && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>URL</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                                            {selectedEvent.meta?.url}
                                        </div>
                                    </div>
                                )}

                                {selectedEvent.meta?.stack && (
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Stack Trace</div>
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
                                            {selectedEvent.meta?.stack}
                                        </pre>
                                    </div>
                                )}
                            </>
                        )}

                        {selectedEvent.metric === 'mutation' && (
                            <>
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Target Element</div>
                                    <div style={{ fontFamily: 'var(--font-mono)', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                        {selectedEvent.meta?.target || 'Unknown'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nodes Added</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--status-good)' }}>
                                            +{Array.isArray(selectedEvent.meta?.added) ? selectedEvent.meta.added.length : 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nodes Removed</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--status-critical)' }}>
                                            -{Array.isArray(selectedEvent.meta?.removed) ? selectedEvent.meta.removed.length : 0}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Raw Mutation Data</div>
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
                                        {JSON.stringify({
                                            attr: selectedEvent.meta?.attr,
                                            oldValue: selectedEvent.meta?.oldValue,
                                            newValue: selectedEvent.meta?.newValue,
                                            added: selectedEvent.meta?.added,
                                            removed: selectedEvent.meta?.removed
                                        }, null, 2)}
                                    </pre>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}