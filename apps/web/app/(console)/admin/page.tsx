import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
export const dynamic = 'force-dynamic';
export default async function Page(){
  await requireOwner();
  return <><PageHeading eyebrow="ADMIN" title="Состояние системы" subtitle="Административный раздел доступен только владельцу."/><section className="panel informative"><h2>M1: защищённая проверка данных</h2><p>Защищённый импорт Footbolno и сверка источников выполняются отдельно через GitHub Actions. Из веб-интерфейса нельзя запускать импорт, обучать модели или изменять источники. Прогнозы ещё не опубликованы, M2 не начат.</p></section></>;
}
