import React from 'react';
import { Note } from '../contexts/TellitContext';
import './NoteItem.css';

interface NoteItemProps {
  note: Note;
}

const NoteItem: React.FC<NoteItemProps> = ({ note }) => {



  const formatTimelineDate = (timestamp: number) => {
    // Backend returns Unix timestamp in seconds, JavaScript Date expects milliseconds
    // Safety check for NaN timestamp
    if (isNaN(timestamp) || timestamp <= 0) {
      console.warn('Invalid timestamp received:', timestamp);
      return { year: '2024', dateString: 'Invalid Date', timeString: 'Invalid Time' };
    }
    
    // Debug: Log the timestamp value
    console.log('Formatting timestamp:', timestamp, 'Type:', typeof timestamp);
    
    // Convert to milliseconds and create date
    const date = new Date(timestamp * 1000);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date created from timestamp:', timestamp);
      return { year: '2024', dateString: 'Invalid Date', timeString: 'Invalid Time' };
    }
    
    // Year in BOLD Montserrat
    const year = date.getFullYear();
    
    // Date in regular Montserrat - "Tuesday, the 2nd of September"
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    
    // Add ordinal suffix to day
    const getOrdinalSuffix = (day: number) => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    const dayWithOrdinal = `${day}${getOrdinalSuffix(day)}`;
    const dateString = `${dayName}, the ${dayWithOrdinal} of ${month}`;
    
    // Time in light Montserrat
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return { year: year.toString(), dateString, timeString };
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const timelineDate = formatTimelineDate(note.createdAt);

  return (
    <div className="note-item">
      <div className="timeline-date-section">
        <div className="timeline-year">{timelineDate.year}</div>
        <div className="timeline-date">{timelineDate.dateString}</div>
        <div className="timeline-time">{timelineDate.timeString}</div>
      </div>
      
      <div className="note-content-section">
        <div className="note-header">
          <div className="note-title-section">
            <h3 className="note-title">{note.title}</h3>
            <div className="note-meta">
              <span className="note-author">
                From: {formatAddress(note.author)}
              </span>
            </div>
          </div>
          
          {/* Edit functionality removed - keeping app simple */}
        </div>

        <div className="note-content">
          {note.content}
        </div>


      </div>
    </div>
  );
};

export default NoteItem;
