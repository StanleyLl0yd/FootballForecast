/**
 * Read an untrusted cross-origin response under a *streaming byte budget*.
 * Content-Length alone is not safe: some servers omit or misreport it.
 */
export async function readResponseTextBounded(response,maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>2_000_000)
    throw new Error('Invalid response byte budget');
  if(!response?.ok||response.status!==200||!response.body)
    throw new Error('Provider response unavailable');
  const header=response.headers.get('content-length');
  if(header!==null&&(!/^\d+$/.test(header)||Number(header)>maxBytes))
    throw new Error('Provider-declared payload size invalid');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let byteCount=0,output='',complete=false;
  try{
    while(true){
      const item=await reader.read();
      if(item.done){complete=true;break}
      if(!(item.value instanceof Uint8Array))throw new Error('Non-byte stream');
      byteCount+=item.value.byteLength;
      if(byteCount>maxBytes)throw new Error('Provider payload exceeds byte budget');
      output+=decoder.decode(item.value,{stream:true});
      if(output.length>maxBytes)throw new Error('Decoded payload too long');
    }
    output+=decoder.decode();
    if(byteCount===0||output.length===0)throw new Error('Empty provider response');
    return output;
  }finally{
    if(!complete)await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}
