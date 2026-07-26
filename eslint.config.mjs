// ESLint 9 Flat Config 占位（保持项目可手动 lint）
// 构建期间通过 next.config 的 eslint.ignoreDuringBuilds 跳过
export default [
  {
    ignores: [".next/**", ".open-next/**", "node_modules/**"],
  },
];
