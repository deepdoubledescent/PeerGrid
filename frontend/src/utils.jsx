import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';


// --- Minimalist Calendar Component ---
const MinimalCalendar = ({ onSelect, initialDate, onClose }) => {
  const [viewDate, setViewDate] = useState(initialDate ? new Date(initialDate) : new Date());
  
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format: YYYY-MM-DD
    const formatted = selectedDate.toISOString().split('T')[0];
    onSelect(formatted);
  };

  const renderDays = () => {
    const days = [];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Empty cells for offset
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    // Day cells
    for (let i = 1; i <= totalDays; i++) {
      days.push(
        <button
          key={i}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur
          onClick={() => handleDateClick(i)}
          className="h-8 w-8 flex items-center justify-center text-sm hover:bg-stone-200 rounded-full transition-colors text-stone-700 font-sans"
        >
          {i}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-stone-50 border border-stone-200 shadow-xl shadow-stone-300/20 p-4 w-64 select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button onMouseDown={(e) => e.preventDefault()} onClick={handlePrevMonth} className="p-1 hover:text-stone-900 text-stone-400">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-sans uppercase tracking-widest font-bold text-stone-700">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button onMouseDown={(e) => e.preventDefault()} onClick={handleNextMonth} className="p-1 hover:text-stone-900 text-stone-400">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-stone-400 font-sans font-bold">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 justify-items-center">
        {renderDays()}
      </div>
    </div>
  );
};

const highlightMarkdownExcerpt = (markdown, searchTerm) => {
  const [contextPadding, setContextPadding] = useState(100);

  // Core Logic: Generate the excerpt with the highlight injection
  const excerptData = useMemo(() => {
    //console.log("memo render");
    if (!searchTerm.trim()) return { text: markdown, isMatch: false };

    const lowerText = markdown.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);

    if (index === -1) return { text: "Term not found.", isMatch: false };

    // 1. Determine excerpt boundaries
    let start = Math.max(0, index - contextPadding);
    let end = Math.min(markdown.length, index + searchTerm.length + contextPadding);

    // Expand to nearest whitespace
    while (start > 0 && markdown[start] !== ' ' && markdown[start] !== '\n') {
        start--;
    }
    while (end < markdown.length && markdown[end] !== ' ' && markdown[end] !== '\n') {
        end++;
    }

    // 2. Extract the raw snippet
    const preMatch = markdown.slice(start, index);
    const match = markdown.slice(index, index + searchTerm.length);
    const postMatch = markdown.slice(index + searchTerm.length, end);

    // 3. Inject the "Link Hijack" syntax
    // We wrap the term in a markdown link with a specific href we can catch later
    const highlightedSnippet = `...${preMatch}[${match}](#highlight-match)${postMatch}...`;

    return { 
      text: highlightedSnippet, 
      isMatch: true 
    };
  });

  return (excerptData);
}

const highlightText = (text, term) => {
  if (!term.trim()) return <span>{text}</span>;

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  
  // Split the text into an array of parts
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={index} className="bg-yellow-100 rounded shadow-sm border border-yellow-100">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};


export { MinimalCalendar, highlightMarkdownExcerpt, highlightText };