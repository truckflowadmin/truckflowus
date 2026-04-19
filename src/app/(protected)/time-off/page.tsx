import { redirect } from 'next/navigation';

export default function TimeOffPage() {
  redirect('/drivers?tab=timeoff');
}
