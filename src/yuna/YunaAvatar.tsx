import './avatar.css';

/** Supplied portrait, cropped only. Adjacent button/text provides the accessible name. */
export default function YunaAvatar({sizes='48px'}:{sizes?:string}) {
 return <img className="yuna-avatar" src="/yun/avatar-160.webp" srcSet="/yun/avatar-160.webp 160w, /yun/avatar-320.webp 320w" sizes={sizes} width={320} height={320} alt="" aria-hidden="true" decoding="async"/>;
}
