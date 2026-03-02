import { motion } from "motion/react";

const logos: { name: string; svg: React.ReactNode }[] = [
  {
    name: "React",
    svg: (
      <svg viewBox="-11.5 -10.232 23 20.463" className="h-5 w-auto" fill="currentColor">
        <circle r="2.05" />
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
    ),
  },
  {
    name: "Next.js",
    svg: (
      <svg viewBox="0 0 180 180" className="h-5 w-auto" fill="currentColor">
        <mask id="nj" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
          <circle cx="90" cy="90" r="90" fill="white" />
          <path d="M149.508 157.52L69.142 54H54v71.97h12.114V69.384l73.885 95.461A90.34 90.34 0 00149.508 157.52z" fill="black" />
          <rect x="115" y="54" width="12" height="72" fill="black" />
        </mask>
        <circle cx="90" cy="90" r="90" mask="url(#nj)" />
      </svg>
    ),
  },
  {
    name: "Vite",
    svg: (
      <svg viewBox="0 0 410 404" className="h-5 w-auto" fill="currentColor">
        <path d="M399.641 59.524l-183.998 329.394c-3.799 6.793-13.559 6.916-17.525.222L12.562 59.517c-4.353-7.35 2.292-15.976 10.342-14.248L200.964 85.14a9.34 9.34 0 003.888-.002l177.247-39.876c8.03-1.728 14.689 6.86 10.342 14.262z" fillOpacity="0.6" />
        <path d="M292.965 1.474l-94.22 18.862a4.678 4.678 0 00-3.676 4.13l-12.306 130.994c-.3 3.192 2.666 5.626 5.762 4.73l27.192-7.87c3.461-1.001 6.616 2.302 5.48 5.736l-13.836 41.811c-1.183 3.575 2.245 6.864 5.72 5.488l21.653-8.563c3.483-1.378 6.912 1.925 5.716 5.507l-22.358 66.896c-1.768 5.29 5.325 8.36 8.15 3.528l1.886-3.225L344.589 39.024c1.823-3.492-1.416-7.482-5.192-6.394l-29.122 8.159c-3.6 1.008-6.694-2.556-5.488-6.319l18.678-58.31c1.21-3.78-1.905-7.373-5.5-6.346z" fillOpacity="0.8" />
      </svg>
    ),
  },
  {
    name: "Remix",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-auto" fill="currentColor">
        <path d="M21.511 18.508c.216 2.773.216 4.073.216 5.492H15.31c0-.309.006-.592.011-.878.018-.892.036-1.821-.109-3.698-.19-2.747-1.374-3.358-3.55-3.358H1.574v-5h10.396c2.748 0 4.122-.835 4.122-3.049 0-1.946-1.374-3.125-4.122-3.125H1.573V0h11.541c6.221 0 9.313 2.938 9.313 7.632 0 3.511-2.176 5.8-5.114 6.182 2.48.497 3.93 1.909 4.198 4.694ZM1.573 24v-3.727h6.784c1.133 0 1.379.84 1.379 1.342V24Z" />
      </svg>
    ),
  },
  {
    name: "Astro",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-auto" fill="currentColor">
        <path d="M8.358 20.162c-1.186-1.07-1.532-3.316-1.038-4.944.856 1.026 2.043 1.352 3.272 1.535 1.897.283 3.76.177 5.522-.678.202-.098.388-.229.608-.36.166.473.209.95.151 1.437-.14 1.185-.738 2.1-1.688 2.794-.38.277-.782.525-1.175.787-1.205.804-1.531 1.747-1.078 3.119l.044.148a3.158 3.158 0 0 1-1.407-1.188 3.31 3.31 0 0 1-.544-1.815c-.004-.32-.004-.642-.048-.958-.106-.769-.472-1.113-1.161-1.133-.707-.02-1.267.411-1.415 1.09-.012.053-.028.104-.045.165h.002zm-5.961-4.445s3.24-1.575 6.49-1.575l2.451-7.565c.092-.366.36-.614.662-.614.302 0 .57.248.662.614l2.45 7.565c3.85 0 6.491 1.575 6.491 1.575L16.088.727C15.93.285 15.663 0 15.303 0H8.697c-.36 0-.615.285-.784.727l-5.516 14.99z" />
      </svg>
    ),
  },
  {
    name: "Tailwind CSS",
    svg: (
      <svg viewBox="0 0 54 33" className="h-4 w-auto" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.514-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" />
      </svg>
    ),
  },
  {
    name: "CSS / Modules",
    svg: (
      <svg viewBox="0 0 124 141.53" className="h-5 w-auto" fill="currentColor">
        <path d="M10.383 126.892L0 0l124 .255-10.979 126.637-50.553 14.638z" fillOpacity="0.5" />
        <path d="M100.851 27.064H22.298l2.128 15.318h37.276l-36.68 15.745 2.127 14.808h54.043l-1.958 20.68-18.298 3.575-16.595-4.255-1.277-11.745H27.83l2.042 24.426 32.681 9.106 31.32-9.957 4-47.745H64.765l36.085-14.978z" fillOpacity="1" />
      </svg>
    ),
  },
];

function LogoItem({ name, svg, index }: { name: string; svg: React.ReactNode; index: number }) {
  return (
    <motion.div
      className="group relative flex flex-col items-center cursor-pointer outline-none"
      tabIndex={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
    >
      <div className="text-white/40 group-hover:text-white/70 group-active:text-white/70 group-focus:text-white/70 transition-colors duration-300 p-3">
        {svg}
      </div>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-white/0 group-hover:text-white/50 group-active:text-white/50 group-focus:text-white/50 translate-y-1 group-hover:translate-y-0 group-active:translate-y-0 group-focus:translate-y-0 transition-all duration-300 pointer-events-none">
        {name}
      </span>
    </motion.div>
  );
}

export function LogoBar() {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-10 flex-wrap pt-10 pb-4">
      {logos.map((logo, i) => (
        <LogoItem key={logo.name} name={logo.name} svg={logo.svg} index={i} />
      ))}
    </div>
  );
}
