'use client';
import {useEffect,useRef} from 'react';
import {supabase} from '@/utils/supabase/client';
import {useExperienceReviews} from '@/utils/useExperienceReviews';
import type {ExperienceReview} from '@/utils/personalExperiences';
export default function ExperienceReviews({reviews,editOwn,viewerId,cardTitle=''}:{reviews:ExperienceReview[];editOwn?:()=>void;viewerId:string|null;cardTitle?:string}){
 const model=useExperienceReviews(supabase,reviews),dialog=useRef<HTMLDialogElement>(null),current=model.selected,extra=current?model.extras[current.id]:null;
 const selectedId=current?.id;
 useEffect(()=>{if(selectedId)dialog.current?.showModal();else dialog.current?.close();},[selectedId]);
 const profile=(review:ExperienceReview)=><a href={review.username?`/u/${encodeURIComponent(review.username)}`:`/people/${review.userId}`} className="flex min-h-11 min-w-0 items-center gap-2 font-bold">{review.avatarUrl?<img src={review.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover"/>:null}<span>{review.name}</span></a>;
 return <><div className="flex flex-wrap gap-2">{(['recent','liked'] as const).map(sort=><button type="button" key={sort} aria-pressed={model.sort===sort} className={`min-h-11 rounded-xl px-3 text-xs font-bold ${model.sort===sort?'bg-emerald-100 text-emerald-900':'bg-white/10'}`} onClick={()=>model.setSort(sort)}>{sort==='recent'?'En güncel':'En çok beğenilen'}</button>)}</div>
 {model.loading?<p role="status" className="text-sm">Deneyimler yükleniyor…</p>:null}
 {model.error?<button type="button" onClick={model.reload} className="min-h-11 text-sm text-amber-200">{model.error} Yeniden dene</button>:null}
 {model.rows.map(review=>{const item=model.extras[review.id];return <section key={review.id} className={`space-y-2 rounded-xl p-3 ${review.isViewer?'border border-emerald-300 bg-emerald-950/70':'bg-white/10'}`}>
 {review.isViewer?<p className="text-xs font-bold text-emerald-200">⌖ Senin deneyimin</p>:null}
 <div className="flex items-center justify-between gap-2 text-xs">{profile(review)}{review.isViewer&&editOwn?<button type="button" aria-label="Deneyimimi düzenle" onClick={editOwn} className="min-h-11 min-w-11 text-lg text-emerald-200">✎</button>:null}</div>
 <p className="text-xs text-amber-200">{review.rating!=null?`★ ${review.rating}/10`:''}{review.date?` · ${review.date}`:''}</p>
 {review.body?<p className="line-clamp-2 whitespace-pre-wrap text-xs leading-5">{review.body}</p>:null}
 {item?.photos.length?<div className="flex gap-2">{item.photos.slice(0,3).map((photo,index)=><button key={photo.path} type="button" onClick={()=>model.open(review.id,index)} aria-label={`${review.name}, ${index+1}. fotoğrafı aç`} className="min-h-11 min-w-0 flex-1"><img src={photo.url} alt="Deneyim fotoğrafı" className="h-20 w-full rounded-lg object-cover"/></button>)}</div>:null}
 <button type="button" onClick={()=>model.open(review.id)} className="min-h-11 text-xs font-bold text-emerald-200">{item?.photos.length?`${item.photos.length} fotoğraf · `:''}Deneyimi gör ›{item?` · ♡ ${item.likeCount}`:''}</button>
 </section>;})}
 <dialog ref={dialog} onCancel={model.close} onClose={model.close} onClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()} className="m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-xl overflow-y-auto rounded-3xl bg-slate-950 p-5 text-white backdrop:bg-black/70" role="dialog" aria-label="Deneyim ayrıntısı">
 {current?<div className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{cardTitle?`${cardTitle} · `:''}{current.isViewer?'Senin deneyimin':'Deneyim'}</h2><button type="button" onClick={model.close} className="min-h-11 min-w-11 rounded-xl bg-white/10">Kapat</button></div>{profile(current)}<p>{current.rating!=null?`★ ${current.rating}/10`:''} {current.date}</p>
 {extra?.photos.length?<div className="space-y-2"><img src={extra.photos[Math.min(model.photoIndex,extra.photos.length-1)]?.url} alt={`${current.name} deneyim fotoğrafı ${model.photoIndex+1}`} className="max-h-[40dvh] w-full rounded-xl object-contain"/><div className="flex items-center justify-between"><button type="button" disabled={model.photoIndex===0} onClick={()=>model.setPhotoIndex(value=>value-1)} className="min-h-11 px-3 disabled:opacity-30">‹ Önceki</button><span>{model.photoIndex+1}/{extra.photos.length}</span><button type="button" disabled={model.photoIndex>=extra.photos.length-1} onClick={()=>model.setPhotoIndex(value=>value+1)} className="min-h-11 px-3 disabled:opacity-30">Sonraki ›</button></div></div>:null}
 {current.body?<p className="whitespace-pre-wrap text-sm leading-6">{current.body}</p>:null}
 {extra?<button type="button" disabled={model.busy||!viewerId} aria-pressed={extra.viewerLiked} onClick={()=>model.like(current.id)} className="min-h-11 rounded-xl bg-emerald-900 px-4">{extra.viewerLiked?'♥ Beğendin':'♡ Beğen'} · {extra.likeCount}</button>:null}
 {model.error?<p role="alert" className="text-amber-200">{model.error}<button type="button" onClick={model.reload} className="min-h-11 px-3 underline">Yeniden dene</button></p>:null}
 <h3 className="font-bold">Yanıtlar{extra?` (${extra.commentCount})`:''}</h3>
 {model.comments.filter(comment=>!comment.deleted_at).map(comment=><div key={comment.comment_id} className="rounded-xl bg-white/10 p-3"><p className="text-sm font-bold">{comment.full_name}</p><p className="whitespace-pre-wrap text-sm">{comment.body}</p>{comment.is_viewer_comment?<button type="button" disabled={model.busy} onClick={()=>model.removeComment(comment.comment_id)} className="min-h-11 text-xs text-red-300">Yanıtımı sil</button>:null}</div>)}
 {model.more?<button type="button" disabled={model.busy} onClick={model.loadMore} className="min-h-11">Daha fazla yanıt</button>:null}
 {viewerId&&extra?.canComment?<form onSubmit={event=>{event.preventDefault();void model.reply();}} className="space-y-2"><label htmlFor="experience-reply">Deneyime yanıt yaz</label><textarea id="experience-reply" value={model.draft} onChange={event=>model.setDraft(event.target.value)} maxLength={2000} className="w-full rounded-xl bg-slate-800 p-3"/><button disabled={model.busy||model.draft.trim().length<2} className="min-h-11 rounded-xl bg-emerald-700 px-4 disabled:opacity-40">Yanıtı gönder</button></form>:<p className="text-sm text-slate-300">{viewerId?'Bu deneyim yanıtlara kapalı.':'Beğenmek ve yanıt yazmak için giriş yap.'}</p>}
 </div>:null}</dialog></>;
}
