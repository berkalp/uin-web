import {SharedExperienceView} from '@/components/seeds/SharedExperiences';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main className="mx-auto max-w-3xl px-4 py-8"><SharedExperienceView id={id}/></main>}
