import { redirect } from 'next/navigation';

export default function SuperadminRoot() {
  redirect('/sa/overview');
}
