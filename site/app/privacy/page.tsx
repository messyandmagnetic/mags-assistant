import { redirect } from 'next/navigation';

export default function PrivacyRedirect() {
  redirect('/policy');
}
