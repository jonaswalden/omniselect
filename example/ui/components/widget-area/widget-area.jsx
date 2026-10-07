import $ from 'omniselect';

export default function WidgetArea(props) {
  const {
    tagName: Tag = 'div',
    className,
    children,
    ...attrs
  } = props;

  return <Tag className={[$.widgetArea, className].join(' ')} {...attrs}>
    { children }
  </Tag>;
}
