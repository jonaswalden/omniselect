import $ from 'omniselect';
import WidgetArea from '../../components/widget-area/widget-area.jsx';
import List from '../../components/list/list.jsx';

export default function Article() {
  return <>
    <article className={$.article}>
    </article>
    <WidgetArea tagName="aside" className={$.article.sidebar}>
      <List />
    </WidgetArea>
  </>;
}
