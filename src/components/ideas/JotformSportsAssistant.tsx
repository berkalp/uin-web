const JOTFORM_SPORTS_AGENT_ID="01a0c4605a2070008b73fa769d62cc72704d";

export default function JotformSportsAssistant({title}:{title:string}){
  const src=`https://agent.jotform.com/${JOTFORM_SPORTS_AGENT_ID}?embedMode=iframe&autofocus=0&background=1&shadow=0`;
  return <section className="mt-6 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white">
    <div className="border-b border-violet-100 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[.16em] text-violet-700">✦ UIN Spor Asistanı</p>
      <h4 className="mt-1 font-black text-slate-950">{title} ve diğer sporlar hakkında sor</h4>
      <p className="mt-1 text-xs text-slate-500">Asistan yalnızca spor ve fiziksel aktivitelerle ilgili sorulara yanıt verir.</p>
    </div>
    <iframe title={`UIN Spor Asistanı — ${title}`} src={src} className="h-[560px] w-full border-0 bg-white" loading="lazy" allow="microphone; fullscreen" referrerPolicy="strict-origin-when-cross-origin"/>
  </section>;
}
