import {readResponseTextBounded} from './limited-response.mjs';

const githubWorkflowBase='https://api.github.com/repos/StanleyLl0yd/FootballForecast/actions/workflows/';
const validStatuses=new Set(['queued','in_progress','completed','waiting','requested','pending']);
const validConclusions=new Set(['success','failure','cancelled','timed_out','neutral','action_required','skipped','stale']);
const shaPattern=/^[a-f0-9]{40}$/;

export type M2RunStatus=
  | {state:'unavailable'|'no_runs'}
  | {state:'run'; id:number; url:string; status:string; conclusion:string|null; sha:string};

/** Server-only read-only public GitHub status. No token, no workflow dispatch. */
async function readM2Run(
  workflowFile:'m2-manual-research-lock.yml'|'m2-public-sources-observe.yml',
  fetchImpl:typeof fetch
):Promise<M2RunStatus>{
  const githubRunsURL=`${githubWorkflowBase}${workflowFile}/runs?branch=main&per_page=10`;
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
       !Array.isArray(body.workflow_runs)||body.workflow_runs.length>10)
      throw Error('Invalid run metadata shape');
    if(body.total_count===0&&body.workflow_runs.length===0)return {state:'no_runs'};
    if(body.total_count<body.workflow_runs.length||body.workflow_runs.length===0)
      throw Error('Inconsistent run metadata');
    for(const candidate of body.workflow_runs){
      if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
        throw Error('Untrusted run metadata');
      const run=candidate as Record<string,unknown>;
      const actor=run.actor;
      if(run.event!=='workflow_dispatch'&&run.event!=='issue_comment')continue;
      if(!actor||typeof actor!=='object'||Array.isArray(actor)||
         (actor as Record<string,unknown>).login!=='StanleyLl0yd')continue;
      // Unrelated owner comments create skipped Actions runs; these are not executed research.
      if(run.event==='issue_comment'&&run.conclusion==='skipped')continue;
      const id=run.id, status=run.status, conclusion=run.conclusion;
      if(typeof id!=='number'||!Number.isSafeInteger(id)||id<=0||
         run.head_branch!=='main'||
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
    }
    return {state:'unavailable'};
  }catch{
    return {state:'unavailable'};
  }
}

/** Run metadata is not proof that source contents passed quality checks. */
export function readM2TrainOnlyRun(fetchImpl:typeof fetch=fetch):Promise<M2RunStatus>{
  return readM2Run('m2-manual-research-lock.yml',fetchImpl);
}

export function readM2PublicSourcesRun(fetchImpl:typeof fetch=fetch):Promise<M2RunStatus>{
  return readM2Run('m2-public-sources-observe.yml',fetchImpl);
}
