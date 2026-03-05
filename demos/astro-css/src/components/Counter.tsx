import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <button onClick={() => setCount((c) => c - 1)}>-</button>
      <span className="counter-value">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
