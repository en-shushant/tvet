// import ppmo from './ppmo.jsx'; // hidden until PPMO format is finalized
import helvetas from './helvetas.jsx';
import firmwise from './firmwise.jsx';
import tools from './tools.jsx';
import detailed from './detailed.jsx';

// Add new report families here — each must match the shape in ppmo.js
const REPORT_FAMILIES = [
  // ppmo,   // hidden until PPMO format is finalized
  helvetas,
  firmwise,
  tools,
  detailed,
  // worldbank,
];

export default REPORT_FAMILIES;
