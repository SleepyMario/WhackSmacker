# 通用规范汉字表 第1级：简体 ⇄ 繁体

- 对应关系：1255
- 双向卡片：2510
- Phrase / Answer：采用已确认的 `character（word）` 格式
- Examples：每个对应关系都有一组实际使用该词的简体、繁体例句；不使用“例句中使用了……”式占位句
- Notes：学习界面不显示
- 未解决的 `X字` 占位：0

`scripts/populate-chinese-level-1-examples.mjs` 会用 `sources/example-provenance.tsv` 中审核过的例句替换旧占位句；`scripts/generate-chinese-level-1.mjs` 会从 `sources/mappings.tsv` 重新生成 `cards.tsv`，并在发现占位例句时拒绝生成。

## 例句来源

- 818 组例句取自或由繁体原句规范化自 [Tatoeba Mandarin Chinese sentence export](https://downloads.tatoeba.org/exports/per_language/cmn/)。每组在 `sources/example-provenance.tsv` 中保留 Tatoeba sentence ID 和原句。Tatoeba 文本依据 [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) 使用。
- 396 组缺少合适语料的例句由本项目编写。
- 原有 41 组已审核例句保留不变。
- 词义核对参考 [CC-CEDICT](https://cc-cedict.org/)，其数据采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 授权。
