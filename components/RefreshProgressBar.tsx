// import React from 'react';

// interface RefreshProgressBarProps {
//     progress: number;
// }

// const RefreshProgressBar: React.FC<RefreshProgressBarProps> = ({ progress }) => {
//     return (
//         <div 
//             role="progressbar" 
//             aria-valuenow={progress} 
//             aria-valuemin={0} 
//             aria-valuemax={100} 
//             aria-label="Time until next data refresh"
//             className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-[60] pointer-events-none"
//         >
//             <div
//                 className="h-full bg-primary"
//                 style={{
//                     width: `${progress}%`,
//                     boxShadow: '0 0 8px #29ffb8',
//                     transition: 'width 100ms linear',
//                 }}
//             />
//         </div>
//     );
// };

// export default RefreshProgressBar;
