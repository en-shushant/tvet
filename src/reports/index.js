import helvetas from './helvetas.jsx';
import firmwise from './firmwise.jsx';
import tools from './tools.jsx';
import detailed from './detailed.jsx';
import enssure from './enssure.jsx';
import bolpatra from './bolpatra.jsx';
import bagmati from './bagmati.jsx';

// Add new report families here — each must match the shape in bolpatra.jsx
const REPORT_FAMILIES = [
  helvetas,
  firmwise,
  tools,
  detailed,
  enssure,
  bolpatra,
  bagmati,
  // worldbank,
];

export default REPORT_FAMILIES;
