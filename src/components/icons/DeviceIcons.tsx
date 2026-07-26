// Apple 官方设备图标（来自 App Store 页面，currentColor 填充）
// 高度默认随字号缩放：h-[1.1em] w-auto，可在外层用 className 覆盖尺寸 / 颜色

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function IphoneIcon({ className = "", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 62.771 103.335"
      aria-hidden="true"
      fill="currentColor"
      className={`h-[1.1em] w-auto ${className}`}
      {...props}
    >
      <path d="M13.275 103.335h36.169c7.963 0 13.326-5.053 13.326-12.665V12.665C62.771 5.053 57.407 0 49.444 0H13.275C5.301 0 0 5.053 0 12.665V90.67c0 7.612 5.301 12.665 13.275 12.665Zm1.005-7.842c-4.09 0-6.427-2.183-6.427-6.116V13.959c0-3.933 2.338-6.106 6.427-6.106h6.27c.766 0 1.181.405 1.181 1.173v1.109c.001 2.002 1.35 3.413 3.352 3.413h12.605c2.054 0 3.34-1.411 3.34-3.413v-1.11c0-.766.415-1.171 1.183-1.171h6.228c4.141-.001 6.427 2.172 6.427 6.106v75.417c0 3.933-2.286 6.116-6.427 6.116Zm6.775-3.581h20.712c1.296 0 2.27-.924 2.27-2.282s-.973-2.27-2.269-2.27H21.055c-1.358 0-2.27.912-2.27 2.27s.912 2.282 2.27 2.282Z" />
    </svg>
  );
}

export function IpadIcon({ className = "", ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16.68 22.021"
      aria-hidden="true"
      fill="currentColor"
      className={`h-[1.1em] w-auto ${className}`}
      {...props}
    >
      <path d="M5.39 19.688h5.538a.436.436 0 0 0 .459-.46c0-.273-.186-.449-.46-.449H5.392c-.264 0-.45.176-.45.45 0 .273.186.459.45.459ZM0 19.424c0 1.543 1.084 2.578 2.705 2.578h10.908c1.621 0 2.705-1.035 2.705-2.578V2.588C16.318 1.045 15.234 0 13.613 0H2.705C1.084 0 0 1.045 0 2.588Zm1.572-.264V2.852c0-.801.489-1.28 1.328-1.28h10.518c.83 0 1.328.479 1.328 1.28V19.16c0 .8-.498 1.27-1.328 1.27H2.9c-.84 0-1.328-.47-1.328-1.27Z" />
    </svg>
  );
}

export function AppleTvIcon({ className = "", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 122.045 97.575"
      aria-hidden="true"
      fill="currentColor"
      className={`h-[1.1em] w-auto ${className}`}
      {...props}
    >
      <path d="M12.523 81.04h97c8.227 0 12.521-4.307 12.521-12.524V12.575C122.045 4.305 117.75 0 109.522 0h-97C4.296 0 0 4.306 0 12.575v55.942c0 8.217 4.295 12.522 12.523 12.522ZM36.49 97.574h49.065a3.93 3.93 0 0 0 3.937-3.914c0-2.249-1.74-3.979-3.937-3.979H36.49c-2.197-.001-3.937 1.729-3.937 3.978a3.93 3.93 0 0 0 3.937 3.916ZM12.658 73.186c-3.172 0-4.805-1.622-4.805-4.794V12.699c0-3.224 1.633-4.845 4.805-4.845h96.73c3.17 0 4.802 1.621 4.802 4.845v55.693c.001 3.172-1.63 4.794-4.803 4.794Z" />
    </svg>
  );
}

export function IMessageIcon({ className = "", ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22.51 20.459"
      aria-hidden="true"
      fill="currentColor"
      className={`h-[1.1em] w-auto ${className}`}
      {...props}
    >
      <path d="M4.238 20.459c1.319 0 4.014-1.328 5.996-2.744 6.807.185 11.914-3.72 11.914-8.838C22.148 3.965 17.227 0 11.074 0 4.922 0 0 3.965 0 8.877c0 3.203 2.05 6.045 5.137 7.47-.44.85-1.26 2.003-1.7 2.579-.517.683-.205 1.533.801 1.533Zm1.026-1.621c-.078.03-.108-.03-.059-.098.547-.674 1.328-1.69 1.66-2.314.274-.508.205-.957-.42-1.25-3.066-1.426-4.824-3.701-4.824-6.299 0-4.004 4.19-7.266 9.453-7.266 5.274 0 9.463 3.262 9.463 7.266 0 3.994-4.19 7.256-9.463 7.256-.195 0-.498-.01-.889-.02-.41 0-.722.127-1.093.42-1.201.87-2.94 1.944-3.828 2.305Z" />
    </svg>
  );
}

export function MacIcon({ className = "", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 140.769 79.424"
      aria-hidden="true"
      fill="currentColor"
      className={`h-[1.1em] w-auto ${className}`}
      {...props}
    >
      <path d="M0 73.887c0 3.049 2.478 5.537 5.475 5.537h129.82c3.038 0 5.475-2.488 5.475-5.537 0-3.09-2.437-5.578-5.475-5.578H124.59v-57.96C124.59 3.52 120.956 0 114.136 0H26.633c-6.457 0-10.452 3.52-10.452 10.35v57.958H5.475C2.478 68.309 0 70.797 0 73.887Zm24.086-5.578V12.585c0-3.161 1.529-4.742 4.7-4.742h83.198c3.171 0 4.751 1.58 4.751 4.742V68.31ZM55.65 7.843h1.244c.728 0 1.143.363 1.143 1.183v.591c0 2.003 1.286 3.413 3.392 3.413h18.036c1.992 0 3.289-1.41 3.289-3.413v-.591c0-.82.415-1.183 1.183-1.183h1.246v-4.02H55.649Z" />
    </svg>
  );
}

/** 平台名 -> 设备图标组件（无对应图标的平台返回 null，由调用方回退 Phosphor） */
export function deviceIcon(platform: string):
  | typeof IphoneIcon
  | typeof IpadIcon
  | typeof AppleTvIcon
  | typeof IMessageIcon
  | typeof MacIcon
  | null {
  switch (platform) {
    case "iPhone":
    case "iPod touch":
      return IphoneIcon;
    case "iPad":
      return IpadIcon;
    case "Apple TV":
      return AppleTvIcon;
    case "iMessage":
    case "Messages":
      return IMessageIcon;
    case "Mac":
      return MacIcon;
    default:
      return null;
  }
}
