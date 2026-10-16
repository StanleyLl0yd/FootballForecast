import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
export const dynamic = 'force-dynamic';
export default async function Page(){
  await requireOwner();
  return <><PageHeading eyebrow="ADMIN" title="Состояние системы" subtitle="Административный раздел доступен только владельцу."/><section className="panel informative"><h2>M0: разработка</h2><p>Импорт, обучение и управление источниками остаются выключенными до разрешения прав и отдельной проверки доступа.</p></section></>;
}
