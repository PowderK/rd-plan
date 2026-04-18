import React, { useState, useRef, useEffect } from 'react';
import styles from './CustomSelect.module.css';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  getOptionStyle?: (value: string) => React.CSSProperties;
  disabled?: boolean;
  highlightStyle?: React.CSSProperties;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  onKeyDown,
  getOptionStyle,
  disabled,
  highlightStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);

  const handleToggle = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleInternalKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') setIsOpen(false);
    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('');
      setIsOpen(false);
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={styles.trigger}
        onClick={handleToggle}
        onKeyDown={handleInternalKeyDown}
        style={highlightStyle}
      >
        <span className={!selectedOption ? styles.placeholder : ''}>
          {selectedOption ? selectedOption.label : ''}
        </span>
        <span className={styles.arrow}>{isOpen ? '▴' : '▾'}</span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.list} role="listbox">
            <div
              className={styles.item}
              role="option"
              aria-selected={value === ''}
              onClick={() => handleSelect('')}
              style={{ minHeight: '1.2em' }}
            >
              &nbsp;
            </div>
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`${styles.item} ${opt.value === value ? styles.itemSelected : ''}`}
                role="option"
                aria-selected={opt.value === value}
                style={getOptionStyle ? getOptionStyle(opt.value) : {}}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
