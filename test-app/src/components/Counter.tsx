import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <h3>Count: {count}</h3>
      <div className="button-group">
        <button onClick={() => setCount(count - 1)}>-</button>
        <button className="reset-button" onClick={() => setCount(0)}>Reset</button>
        <button onClick={() => setCount(count + 1)}>플러스</button>
      </div>
    </div>
  );
}

export default Counter;
