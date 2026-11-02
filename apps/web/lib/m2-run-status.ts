import {readResponseTextBounded} from './limited-response.mjs';

const githubRunsURL='https://api.github.com/repos/StanleyLl0yd/FootballForecast/actions/workflows/m2-manual-research-lock.yml/runs?branch=main&per_page=1';
const validStatuses=new Set(['queued','in_progress','completed','waiting','requested','pending']);
const validConclusions=new Set(['success','failure','cancelled','timed_out','neutral','action_required','skipped','stale']);
const shaPattern=/^[a-f0-9]{40}$/;

export type M2RunStatus=
  | {state:'unavailable'|'no_runs'}
  | {state:'run'; id:number; url:string; status:string; conclusion:string|null; sha:string};

/** Server-only read-only public GitHub status. No token, no workflow dispatch. */
export async function readM2TrainOnlyRun(
  fetchImpl:typeof fetch=fetch
):Promise<M2RunStatus>{
  try{
    const response=await fetchImpl(githubRunsURL,{
      method:'GET',
      headers:{Accept:'application/vnd.github+json'},
      next:{revalidate:300},
      signal:AbortSignal.timeout(3000)
    });
    const value:unknown=JSON.parse(await readResponseTextBounded(response,128*1024));
    if(!value||typeof value!=='object'||Array.isArray(value))
      throw Error('Invalid run metadata');
    const body=value as Record<string,unknown>;
    if(typeof body.total_count!=='number'||!Number.isSafeInteger(body.total_count)||body.total_count<0||
       !Array.isArray(body.workflow_runs)||body.workflow_runs.length>1)
      throw Error('Invalid run metadata shape');
    if(body.total_count===0&&body.workflow_runs.length===0)return {state:'no_runs'};
    if(body.total_count===0||body.workflow_runs.length!==1)
      throw Error('Inconsistent run metadata');
    const candidate:unknown=body.workflow_runs[0];
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
      throw Error('Missing trusted run metadata');
    const run=candidate as Record<string,unknown>;
    const id=run.id, status=run.status, conclusion=run.conclusion;
    if(typeof id!=='number'||!Number.isSafeInteger(id)||id<=0||
       run.event!=='workflow_dispatch'||run.head_branch!=='main'||
       typeof run.head_sha!=='string'||!shaPattern.test(run.head_sha)||
       typeof status!=='string'||!validStatuses.has(status)||
       (conclusion!==null&&(typeof conclusion!=='string'||!validConclusions.has(conclusion)))||
       (status==='completed'&&conclusion===null)||
       (status!=='completed'&&conclusion!==null)||
       run.html_url!==`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${id}`)
      throw Error('Untrusted run metadata');
    return {
      state:'run',id:Number(id),url:String(run.html_url),
      status,conclusion:conclusion as string|null,sha:run.head_sha
    };
  }catch{
    return {state:'unavailable'};
  }
}
