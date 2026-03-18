function Toast({ mensaje }) {
    if (!mensaje.texto) return null;

    return (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${
            mensaje.tipo === 'exito'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
            <span className="text-lg">{mensaje.tipo === 'exito' ? '✅' : '❌'}</span>
            {mensaje.texto}
        </div>
    );
}

export default Toast;