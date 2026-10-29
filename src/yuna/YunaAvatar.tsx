import './avatar.css';

/** Supplied portrait, cropped only. Adjacent button/text provides the accessible name. */
export default function YunaAvatar({sizes='48px'}:{sizes?:string}) {
 return <img className="yuna-avatar" src="/yuna/avatar-160.webp" srcSet="/yuna/avatar-160.webp 160w, /yuna/avatar-320.webp 320w" sizes={sizes} width={320} height={320} alt="" aria-hidden="true" decoding="async"/>;
}
