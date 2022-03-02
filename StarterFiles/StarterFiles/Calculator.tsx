import React from 'react';
import './Calculator.css';

function CalculatorDisplay() {
  return <div className="calculator-display">{0}</div>;
}
function CalculatorKey(arg: any) {
  return <button className={`calculator-key ${arg.className}`}  onClick={arg.onPress}>{arg.label}</button>;         
}
export default function Calculator() {
  return (
    <div className="calculator">
      <CalculatorDisplay/>
      <div className="calculator-keypad">
        <div className="input-keys">
          <div className="function-keys">
            <CalculatorKey className="key-clear" label="C" onPress={() => { alert("key-clear pressed"); }}>{'C'}</CalculatorKey>
            <CalculatorKey className="key-sign" label="±" onPress={() => { alert("key-sign pressed"); }}>±</CalculatorKey>
            <CalculatorKey className="key-percent" label="√" onPress={() => { alert('key-sqrt pressed'); }}>√</CalculatorKey>
          </div>
          <div className="digit-keys">
            <CalculatorKey className="key-0" label="0" onPress={() => { alert('key-0 pressed'); }}>0</CalculatorKey>
            <CalculatorKey className="key-dot" label="•" onPress={() => { alert('key-dot pressed'); }}>●</CalculatorKey>
            <CalculatorKey className="key-1" label="1" onPress={() => { alert('key-1 pressed'); }}>1</CalculatorKey>
            <CalculatorKey className="key-2" label="2" onPress={() => { alert('key-2 pressed'); }}>2</CalculatorKey>
            <CalculatorKey className="key-3" label="3" onPress={() => { alert('key-3 pressed'); }}>3</CalculatorKey>
            <CalculatorKey className="key-4" label="4" onPress={() => { alert('key-4 pressed'); }}>4</CalculatorKey>
            <CalculatorKey className="key-5" label="5" onPress={() => { alert('key-5 pressed'); }}>5</CalculatorKey>
            <CalculatorKey className="key-6" label="6" onPress={() => { alert('key-6 pressed'); }}>6</CalculatorKey>
            <CalculatorKey className="key-7" label="7" onPress={() => { alert('key-7 pressed'); }}>7</CalculatorKey>
            <CalculatorKey className="key-8" label="8" onPress={() => { alert('key-8 pressed'); }}>8</CalculatorKey>
            <CalculatorKey className="key-9" label="9" onPress={() => { alert('key-9 pressed'); }}>9</CalculatorKey>
          </div>
        </div>
        <div className="operator-keys">
          <CalculatorKey className="key-divide" label="/" onPress={() => { alert('key-divide pressed'); }}>÷</CalculatorKey>
          <CalculatorKey className="key-multiply" label="×" onPress={() => { alert('key-multiply pressed'); }}>*</CalculatorKey>
          <CalculatorKey className="key-subtract" label="-" onPress={() => { alert('key-minus pressed'); }}>−</CalculatorKey>
          <CalculatorKey className="key-add" label="+" onPress={() => { alert('key-add pressed'); }}>+</CalculatorKey>
          <CalculatorKey className="key-equals" label="=" onPress={() => { alert('key-equals pressed'); }}>=</CalculatorKey>
        </div>
      </div>
    </div>
  ) 
}