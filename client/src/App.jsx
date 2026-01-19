import FloatingLines from '@/components/FloatingLines'
import './App.css'

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <FloatingLines
        enabledWaves={["top", "middle", "bottom"]}
        lineCount={[5, 7, 6]}
        lineDistance={[6, 8, 5]}
        bendRadius={5}
        bendStrength={-0.5}
        interactive
        parallax
        linesGradient={["#8b5cf6", "#06b6d4", "#22d3ee", "#a78bfa"]}
      />
    </div>
  )
}

export default App
