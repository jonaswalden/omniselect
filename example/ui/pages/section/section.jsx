import $ from 'selectors';
import List from '../../components/list/list.jsx';

export default function Section() {
  return <main className={$.section}>
    <List />
  </main>
}
