import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../Icon.tsx';

/** Searches the scenario library: it opens the library with the words already typed in. */
export function TopbarSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  return (
    <form
      role="search"
      className="topbar-search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = text.trim();
        void navigate(q ? `/scenarios?q=${encodeURIComponent(q)}` : '/scenarios');
        setText('');
      }}
    >
      <label className="sr-only" htmlFor="topbar-search">
        Search all scenarios
      </label>
      <span className="input-icon">
        <Icon name="search" size={18} />
        <input
          id="topbar-search"
          className="input"
          type="search"
          value={text}
          maxLength={80}
          placeholder="Search scenarios…"
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
        />
      </span>
    </form>
  );
}
