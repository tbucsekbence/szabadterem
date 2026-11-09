import { IconCalendar, IconCard, IconCheck, IconUser } from './Icons';

const STEPS = [
  { icon: IconUser, title: 'Lépj be Google-lel', text: 'Első alkalommal egy rövid profilt kérünk: tanítasz-e, hol, és hány fővel tervezel.' },
  { icon: IconCalendar, title: 'Válassz termet és időpontot', text: 'Nézd meg élőben a szabad órákat, és jelöld ki a neked megfelelő sávot.' },
  { icon: IconCard, title: 'Fizess online', text: 'Bankkártyával, Apple Pay-jel vagy Google Pay-jel, a Stripe biztonságos felületén.' },
  { icon: IconCheck, title: 'Gyere és táncolj', text: 'A visszaigazolást e-mailben kapod, a foglalásaidat a fiókodban követheted.' },
];

export default function Steps() {
  return (
    <ol className="steps">
      {STEPS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="step">
          <span className="step-num">{i + 1}</span>
          <Icon className="step-icon" />
          <h3>{title}</h3>
          <p>{text}</p>
        </li>
      ))}
    </ol>
  );
}
