-- This short catalogue count query is faster without per-connection JIT compilation.
alter function public.get_uin_category_counts_v129() set jit = off;
