import React, { useState, useMemo } from 'react';
import './AttendanceCalendar.css';
import { parseISO, getBangkokYMD } from '../utils/date';

export default function AttendanceCalendar({ employees, allRecords }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDayInfo = (day) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Use the same robust comparison for "Today"
    const isToday = getBangkokYMD(new Date()) === getBangkokYMD(date);

    return { isWeekend, isToday };
  };

  const attendanceData = useMemo(() => {
    const data = {};
    employees.forEach(emp => {
      data[emp.name] = {
        days: {},
        presentCount: 0
      };
    });

    allRecords.forEach(record => {
      const d = parseISO(record.time);
      const recordYMD = getBangkokYMD(d);
      const [rYear, rMonth, rDay] = recordYMD.split('-').map(Number);

      // Comparison logic (months are 1-indexed in YMD string, 0-indexed in JS Date)
      if (rYear === year && (rMonth - 1) === month) {
        if (data[record.userName] && record.type === 'checkin') {
          if (!data[record.userName].days[rDay]) {
            data[record.userName].days[rDay] = true;
            data[record.userName].presentCount += 1;
          }
        }
      }
    });

    return data;
  }, [employees, allRecords, year, month]);

  const getSummaryClass = (percentage) => {
    if (percentage >= 85) return 'high';
    if (percentage >= 60) return 'medium';
    return 'low';
  };

  return (
    <div className="attendance-calendar-container">
      <div className="calendar-header">
        <div className="calendar-title-group">
          <h3>Attendance Heatmap</h3>
          <p>Monthly visual presence report for all employees</p>
        </div>
        <div className="calendar-controls">
          <button onClick={prevMonth} className="btn-nav">←</button>
          <span className="month-label">{monthName} {year}</span>
          <button onClick={nextMonth} className="btn-nav">→</button>
        </div>
      </div>

      <div className="calendar-scroll-area">
        <table className="calendar-grid-table">
          <thead>
            <tr>
              <th className="col-employee">Employee</th>
              {daysArray.map(day => {
                const { isWeekend } = getDayInfo(day);
                return (
                  <th key={day} className={`day-header ${isWeekend ? 'is-weekend' : ''}`}>
                    {day}
                  </th>
                );
              })}
              <th className="col-summary">Monthly Summary</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={daysInMonth + 2} style={{ textAlign: 'center', padding: '40px' }} className="muted">
                  No employee data available for this view.
                </td>
              </tr>
            ) : (
              employees.map(emp => {
                const stats = attendanceData[emp.name] || { days: {}, presentCount: 0 };
                const attendancePercentage = Math.round((stats.presentCount / daysInMonth) * 100);

                return (
                  <tr key={emp.id}>
                    <td className="col-employee">
                      <div className="employee-cell">
                        <span className="employee-name">{emp.name}</span>
                        <span className="employee-meta">{emp.email}</span>
                      </div>
                    </td>
                    {daysArray.map(day => {
                      const isPresent = stats.days[day];
                      const { isWeekend, isToday } = getDayInfo(day);

                      let cellClass = "heatmap-cell ";
                      if (isPresent) cellClass += "cell-present ";
                      else if (isWeekend) cellClass += "cell-weekend ";
                      else cellClass += "cell-absent ";

                      if (isToday) cellClass += "cell-today ";

                      const tooltip = `${emp.name} - ${day} ${monthName}: ${isPresent ? 'Present' : (isWeekend ? 'Weekend' : 'Absent')}`;

                      return (
                        <td key={day}>
                          <div
                            className={cellClass}
                            title={tooltip}
                          />
                        </td>
                      );
                    })}
                    <td className="col-summary">
                      <div className={`summary-tag ${getSummaryClass(attendancePercentage)}`}>
                        {stats.presentCount}/{daysInMonth} ({attendancePercentage}%)
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="calendar-footer">
        <div className="legend">
          <div className="legend-item">
            <div className="legend-box cell-present" /> <span>Present</span>
          </div>
          <div className="legend-item">
            <div className="legend-box cell-absent" /> <span>Absent</span>
          </div>
          <div className="legend-item">
            <div className="legend-box cell-weekend" /> <span>Weekend</span>
          </div>
          <div className="legend-item">
            <div className="legend-box" style={{ boxShadow: '0 0 0 2px var(--today-border)' }} /> <span>Today</span>
          </div>
        </div>
        <div className="stats-brief">
          Total Employees: {employees.length}
        </div>
      </div>
    </div>
  );
}
