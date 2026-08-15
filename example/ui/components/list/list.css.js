import $ from 'selectors';
import css from '../../utils/css-template-literal.js';

export default css`
  $.list { list-style-type: roman }
  $.list.item + $.list.item { margin-top: 0.5em }
`;
