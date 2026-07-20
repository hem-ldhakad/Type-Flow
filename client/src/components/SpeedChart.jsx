import React from 'react';

/**
 * SpeedChart renders a beautiful SVG-based line graph of WPM over time.
 * @param {Object} props
 * @param {number[]} props.wpmHistory - Array of WPM values at each second
 * @param {string} [props.userName] - Optional player name
 */
export default function SpeedChart({ wpmHistory = [], userName }) {
    if (!wpmHistory || wpmHistory.length === 0) return null;

    // Filter out initial zero if it represents standard starting phase, or keep it.
    // If length is 1, let's duplicate the point to show a flat line.
    const data = [...wpmHistory];
    if (data.length === 1) {
        data.push(data[0]);
    }

    const maxWpm = Math.max(...data, 80); // Y axis max value, minimum 80 WPM
    const minWpm = 0; // Y axis starts at 0
    const wpmRange = maxWpm - minWpm;
    const totalPoints = data.length;

    // SVG Layout Dimensions
    const svgWidth = 600;
    const svgHeight = 220;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 35;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    // Map data indices and WPM to SVG coordinates
    const getCoords = (index, wpm) => {
        const x = paddingLeft + (index / (totalPoints - 1)) * chartWidth;
        // SVG Y runs from top to bottom
        const y = paddingTop + chartHeight - ((wpm - minWpm) / wpmRange) * chartHeight;
        return { x, y };
    };

    // Construct SVG path coordinates
    const points = data.map((wpm, idx) => getCoords(idx, wpm));

    // Formulate a smooth bezier curve path or a clean line path
    // For simplicity and perfect rendering, we will generate a smooth line path
    let linePathD = '';
    let areaPathD = '';

    if (points.length > 0) {
        linePathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            linePathD += ` L ${points[i].x} ${points[i].y}`;
        }

        // Area path flows down to the bottom axis and closes the loop for the gradient fill
        areaPathD = `${linePathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }

    // Grid lines calculation
    const gridLines = [];
    const stepCount = 4; // 4 rows
    for (let i = 0; i <= stepCount; i++) {
        const value = Math.round(minWpm + (i / stepCount) * wpmRange);
        const y = paddingTop + chartHeight - (i / stepCount) * chartHeight;
        gridLines.push({ value, y });
    }

    // X-axis label calculation (sample labels every 5s or 10s depending on match length)
    const xLabels = [];
    const labelSpacing = Math.max(1, Math.ceil(totalPoints / 6));
    for (let i = 0; i < totalPoints; i += labelSpacing) {
        xLabels.push(i);
    }
    // Always include the final label if not already present
    if (xLabels[xLabels.length - 1] !== totalPoints - 1) {
        xLabels.push(totalPoints - 1);
    }

    // Compute average WPM
    const avgWpm = Math.round(data.reduce((sum, val) => sum + val, 0) / data.length);
    const peakWpm = Math.max(...data);

    return (
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <defs>
                {/* Dark gradient for the line stroke */}
                <linearGradient id="chartLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                {/* Fading area gradient */}
                <linearGradient id="chartAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.01" />
                </linearGradient>
            </defs>

            {/* Grid Lines */}
            {gridLines.map((line, idx) => (
                <g key={idx}>
                    <line
                        x1={paddingLeft}
                        y1={line.y}
                        x2={svgWidth - paddingRight}
                        y2={line.y}
                        stroke="var(--border-color, #eef2f6)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                    <text
                        x={paddingLeft - 10}
                        y={line.y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="500"
                        fill="var(--text-muted, #a0aec0)"
                        fontFamily="inherit"
                    >
                        {line.value}
                    </text>
                </g>
            ))}

            {/* Area Gradient Fill */}
            {areaPathD && (
                <path
                    d={areaPathD}
                    fill="url(#chartAreaGrad)"
                />
            )}

            {/* Main Curve Line */}
            {linePathD && (
                <path
                    d={linePathD}
                    fill="none"
                    stroke="url(#chartLineGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* Data Points / Markers */}
            {points.map((pt, idx) => {
                const isPeak = data[idx] === peakWpm;
                return (
                    <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={isPeak ? 4.5 : 2.5}
                        fill={isPeak ? '#ec4899' : '#8b5cf6'}
                        stroke="#ffffff"
                        strokeWidth={isPeak ? 2 : 1}
                        style={{ transition: 'all 0.2s' }}
                    />
                );
            })}

            {/* X-Axis Grid Labels */}
            {xLabels.map((val, idx) => {
                const coords = getCoords(val, data[val]);
                return (
                    <text
                        key={idx}
                        x={coords.x}
                        y={svgHeight - paddingBottom + 18}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="500"
                        fill="var(--text-muted, #a0aec0)"
                        fontFamily="inherit"
                    >
                        {val}s
                    </text>
                );
            })}

            {/* X-Axis line */}
            <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight}
                x2={svgWidth - paddingRight}
                y2={paddingTop + chartHeight}
                stroke="var(--border-color, #eef2f6)"
                strokeWidth="1.5"
            />
        </svg>
    );
}
