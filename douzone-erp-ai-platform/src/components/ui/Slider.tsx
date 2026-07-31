import s from './ui.module.css';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step, unit = '%', onChange }: SliderProps) {
  return (
    <div className={s.slider}>
      <label className={s.sliderTop}>
        <span>{label}</span>
        <span className={s.sliderVal}>
          {value}
          {unit}
        </span>
      </label>
      <input
        className={s.sliderInput}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default Slider;
