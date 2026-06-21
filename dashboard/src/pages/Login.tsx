import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Crucial for the browser to accept the HttpOnly Set-Cookie header from the backend
                credentials: 'include', 
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            // data.user contains the user info. The cookie was automatically set by the browser!
            login(data.user);
            
            // Redirect to dashboard overview
            navigate('/');
            
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='flex-center' style={{ minHeight: '80vh' }}>
            <div className='glass-card' style={{ 
                width: '100%', 
                maxWidth: '400px', 
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                        {isRegistering 
                            ? 'Start monitoring your Web Vitals today.' 
                            : 'Log in to view your projects.'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        border: '1px solid var(--status-critical)',
                        borderRadius: '6px',
                        color: 'var(--status-critical)',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Email</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            fontWeight: '600',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {isLoading ? 'Processing...' : isRegistering ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                    <button 
                        onClick={() => setIsRegistering(!isRegistering)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: '500',
                            textDecoration: 'underline'
                        }}
                    >
                        {isRegistering ? 'Log In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
}
