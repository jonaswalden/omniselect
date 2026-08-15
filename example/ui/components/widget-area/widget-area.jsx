import $ from 'selectors';
import './widget-area.css';

export default function WidgetArea(props) {
  const {
    tagName = Tag,
    className,
    children,
    ...attrs
  } = props;

  return <Tag className={[$.widgetArea, className].join(' ')} {...attrs}>
    { children }
  </Tag>;
}
