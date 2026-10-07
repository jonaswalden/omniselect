import $ from 'omniselect';

const items = [
  'What is your name?',
  'What is your quest?',
  'What is your favorite color?',
];

export default function List() {
  return <div className={$.list}>
    <ol>
      {items.map((item) => {
        return <li className={$.list.item}>
          {item}
        </li>
      })}
    </ol>
  </div>
}
