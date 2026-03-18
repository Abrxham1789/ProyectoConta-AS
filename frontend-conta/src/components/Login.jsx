import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usuariosService from '../services/usuariosService';
import Toast from './Toast';

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ USERNAME: '', PASSWORD_HASH: '' });
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [cargando, setCargando] = useState(false);

    const mostrarMensaje = (texto, tipo) => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleLogin = async () => {
        if (!form.USERNAME || !form.PASSWORD_HASH) {
            mostrarMensaje('Por favor completa todos los campos', 'error');
            return;
        }
        setCargando(true);
        try {
            const res = await usuariosService.login({
                USERNAME: form.USERNAME,
                PASSWORD_HASH: form.PASSWORD_HASH
            });
            login(res.data);
            navigate('/');
        } catch (err) {
            mostrarMensaje('Usuario o contraseña incorrectos', 'error');
            setCargando(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <>
            <style>{`
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .login-bg {
                    background: linear-gradient(-45deg, #0a1628, #1E3A5F, #1a4a7a, #0d2d4e, #162d4a, #2a5298);
                    background-size: 400% 400%;
                    animation: gradientShift 10s ease infinite;
                }
                .fade-up {
                    animation: fadeUp 0.7s ease forwards;
                }
                .fade-up-delay {
                    opacity: 0;
                    animation: fadeUp 0.7s ease 0.2s forwards;
                }
                .btn-shimmer {
                    position: relative;
                    overflow: hidden;
                }
                .btn-shimmer::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0;
                    width: 60%;
                    height: 100%;
                    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.3), transparent);
                    transform: translateX(-100%);
                    transition: none;
                }
                .btn-shimmer:hover::after {
                    animation: shimmer 0.6s ease forwards;
                }
                .input-login {
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 10px;
                    padding: 12px 16px;
                    color: white;
                    font-size: 14px;
                    width: 100%;
                    outline: none;
                    transition: all 0.3s ease;
                }
                .input-login::placeholder {
                    color: rgba(147, 197, 253, 0.7);
                }
                .input-login:focus {
                    background: rgba(255,255,255,0.13);
                    border-color: rgba(255,255,255,0.5);
                    box-shadow: 0 0 0 3px rgba(255,255,255,0.1);
                }
                .card-glass {
                    background: rgba(255,255,255,0.07);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 20px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
                }
            `}</style>

            <div className="login-bg min-h-screen flex items-center justify-center px-4">
                <Toast mensaje={mensaje} />

                <div className="w-full max-w-md">
                    {/* Logo y título */}
                    <div className="text-center mb-8 fade-up">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 border border-white/20 mb-5 shadow-lg">
                            <span className="text-4xl">🏦</span>
                        </div>
                        <h1 className="text-white text-4xl font-bold tracking-wide mb-2">
                            Sistema Contable
                        </h1>
                        <p className="text-blue-200 text-sm">
                            Plataforma de gestión financiera
                        </p>
                    </div>

                    {/* Tarjeta */}
                    <div className="card-glass p-8 fade-up-delay">
                        <h2 className="text-white font-bold text-xl mb-1 text-center">
                            Bienvenido
                        </h2>
                        <p className="text-blue-200 text-xs text-center mb-6">
                            Ingresa tus credenciales para acceder
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-blue-100 text-xs font-semibold mb-2 uppercase tracking-widest">
                                    Usuario
                                </label>
                                <input
                                    name="USERNAME"
                                    value={form.USERNAME}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ingresa tu usuario"
                                    className="input-login"
                                />
                            </div>

                            <div>
                                <label className="block text-blue-100 text-xs font-semibold mb-2 uppercase tracking-widest">
                                    Contraseña
                                </label>
                                <input
                                    name="PASSWORD_HASH"
                                    value={form.PASSWORD_HASH}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    type="password"
                                    placeholder="Ingresa tu contraseña"
                                    className="input-login"
                                />
                            </div>

                            <button
                                onClick={handleLogin}
                                disabled={cargando}
                                className="btn-shimmer w-full bg-white text-[#1E3A5F] font-bold py-3 rounded-xl text-sm hover:bg-blue-50 transition-all shadow-lg mt-2 disabled:opacity-60"
                            >
                                {cargando ? 'Verificando...' : 'Ingresar al Sistema'}
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-blue-300/60 text-xs mt-6">
                        Sistema Contable — Análisis de Sistemas
                    </p>
                </div>
            </div>
        </>
    );
}

export default Login;