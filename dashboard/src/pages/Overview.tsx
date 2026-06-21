import { useQuery } from '@tanstack/react-query'
import { useWebSocket, type LiveEvent } from '../hooks/useWebSocket'
import { VitalGauge } from '../components/VitalGauge'
import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useDomain } from '../context/DomainContext'

interface MetricResponse {
    overall: {
        metric: 'lcp' | 'fid' | 'cls' | 'ttfb';
        p75: number
    }[];
    series: { time: string; metric: string; p75: number }[];
}
export function OverviewPage() {
    const { domain } = useDomain();
    const [range, setRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
    const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null)

    const { data, isLoading } = useQuery<MetricResponse>({
        queryKey: ['metrics', domain, range],
        queryFn: async () => {
            // Your backend is mounted at /api/metrics, so hitting /metrics directly gives a 404!
            const res = await fetch(`/api/metrics?domain=${domain}&range=${range}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch metrics')
            const data: MetricResponse = await res.json();
            return data;
        },
        refetchInterval: 30000
    });

    const liveEvents = useWebSocket(domain);

    const getMetricValue = (metricName: string) => {
        // Loop backwards (i >= 0, not i < 0)
        for (let i = liveEvents.length - 1; i >= 0; i--) {
            if (liveEvents[i].metric === metricName) {
                return liveEvents[i].value
            }
        }

        const historical = data?.overall.find(m => m.metric === metricName);
        return historical ? historical.p75 : null;
    };

    const chartData = useMemo(() => {
        const grouped: Record<string, any> = {};

        // 1. Add historical series data from the API
        if (data?.series) {
            for (const curr of data.series) {
                const time = new Date(curr.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                if (!grouped[time]) grouped[time] = { time }
                grouped[time][curr.metric] = curr.p75
            }
        }

        // 2. Merge live WebSocket events into the chart
        //    Each event gets bucketed by its minute so it appears as a new data point
        for (const ev of liveEvents) {
            const time = new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            if (!grouped[time]) grouped[time] = { time }
            // Live events override - latest value wins for that time bucket
            grouped[time][ev.metric] = ev.value
        }

        return Object.values(grouped)
    }, [data?.series, liveEvents])

    if (isLoading) {
        return <div
            className='container flex-center' style={{ height: '50vh' }}>Loading metrics...</div>
    }
    return (
        <div className='container' style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ margin: 0 }}>Performance Overview: {domain}</h1>
                <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    {(['1h', '24h', '7d', '30d'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                background: range === r ? 'var(--accent-primary)' : 'transparent',
                                color: range === r ? 'white' : 'var(--text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: range === r ? '600' : '500',
                                transition: 'all 0.2s',
                                fontSize: '0.875rem'
                            }}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem'
            }}>
                <VitalGauge metric='lcp' label='Largest Contentful Paint' value={getMetricValue('lcp')} />
                <VitalGauge metric='fid' label='First Input Delay' value={getMetricValue('fid')} />
                <VitalGauge metric='cls' label='Cumulative Layout Shift' value={getMetricValue('cls')} />
                <VitalGauge metric='ttfb' label='Time to First Byte' value={getMetricValue('ttfb')} />
            </div>

            {/** Historical Chart */}
            <div className='glass-card' style={{ marginBottom: '3rem', padding: '1.5rem', height: 400 }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Performance Over Time (p75)</h2>
                {chartData.length === 0 ? (
                    <div className='flex-center' style={{ height: '100%', color: 'var(--text-muted)' }}>
                        Waiting for historical data...
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="time" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="lcp" stroke="var(--status-warning)" strokeWidth={2} dot={false} name="LCP (ms)" />
                            <Line type="monotone" dataKey="fid" stroke="var(--status-good)" strokeWidth={2} dot={false} name="FID (ms)" />
                            <Line type="monotone" dataKey="ttfb" stroke="var(--accent-primary)" strokeWidth={2} dot={false} name="TTFB (ms)" />
                            <Line type="monotone" dataKey="cls" stroke="var(--status-critical)" strokeWidth={2} dot={false} name="CLS" />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/** Live Websocket Event Feed */}
            <div style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-good)',
                    boxShadow: '0 0 10px var(--status-good)'
                }} /><h2>Live Event Feed</h2>
            </div>
            <div className='glass-card' style={{
                padding: '1rem',
                maxHeight: '300px',
                overflow: 'auto'
            }}>
                {liveEvents.length === 0 ? (
                    <p style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-muted)'
                    }}>Waiting for events...</p>
                ) : (<table style={{
                    width: '100%',
                    textAlign: 'left',
                    borderCollapse: 'collapse'
                }}>
                    <thead>
                        <tr style={{
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <th style={{ padding: '0.5rem' }}>Time</th>
                            <th style={{ padding: '0.5rem' }}>Type</th>
                            <th style={{ padding: '0.5rem' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Render backwards so newest is at the top */}
                        {[...liveEvents].reverse().map((ev, i) => {
                            const isVital = ['lcp', 'fid', 'cls', 'ttfb'].includes(ev.metric);
                            const isError = ev.metric === 'error';
                            const isMutation = ev.metric === 'mutation';
                            const isClickable = isError || isMutation;

                            // Color-code the type badge
                            const typeColor = isError
                                ? 'var(--status-critical)'
                                : isVital
                                    ? 'var(--accent-primary)'
                                    : 'var(--text-muted)';

                            // Format the details column based on event type
                            let details: string;
                            if (isVital && ev.value !== null) {
                                details = ev.metric === 'cls'
                                    ? ev.value.toFixed(3)
                                    : `${Math.round(ev.value)}ms`;
                            } else if (isError) {
                                details = ev.message || 'Unknown error';
                            } else {
                                // Mutation
                                details = `${ev.target || 'unknown'} (+${ev.added || 0} / -${ev.removed || 0} nodes)`;
                            }

                            return (
                                <tr key={i}
                                    onClick={() => isClickable && setSelectedEvent(ev)}
                                    style={{
                                        borderBottom: '1px solid var(--border-subtle)',
                                        cursor: isClickable ? 'pointer' : 'default',
                                        transition: 'background-color 0.2s',
                                        backgroundColor: isError ? 'rgba(255, 68, 68, 0.05)' : isMutation ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (isError) e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
                                        if (isMutation) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (isError) e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.05)';
                                        if (isMutation) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                    }}
                                >
                                    <td style={{
                                        padding: '0.5rem',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.875rem'
                                    }}>
                                        {new Date(ev.time || Date.now()).toLocaleTimeString()}
                                    </td>
                                    <td style={{
                                        padding: '0.5rem',
                                        fontWeight: 600,
                                        color: typeColor,
                                        textTransform: 'uppercase'
                                    }}>
                                        {ev.metric}
                                    </td>
                                    <td style={{
                                        padding: '0.5rem',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: isError ? '0.8rem' : undefined,
                                        color: isError ? 'var(--status-critical)' : undefined,
                                        maxWidth: '300px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {details}
                                    </td>
                                </tr>
                            );
                        })}

                    </tbody>

                </table>)}
            </div>

            {/* Error Details Modal */}
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
                                        {selectedEvent.message}
                                    </div>
                                </div>

                                {selectedEvent.url && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>URL</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                                            {selectedEvent.url}
                                        </div>
                                    </div>
                                )}

                                {selectedEvent.stack && (
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
                                            {selectedEvent.stack}
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
                                        {selectedEvent.target || 'Unknown'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nodes Added</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--status-good)' }}>
                                            +{selectedEvent.added || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nodes Removed</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--status-critical)' }}>
                                            -{selectedEvent.removed || 0}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
