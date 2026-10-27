# Feito de Nós — site da loja

Site estático (sem build). Abra `index.html` sem configurar nada para ver uma demonstração com produtos de exemplo.

## Ligar ao Supabase
1. Authentication > Users > Add user: crie o usuário admin (e-mail + a senha que você vai usar).
2. Authentication > Sign In / Providers: desative "Allow new users to sign up".
3. SQL Editor: cole `supabase/schema.sql`, troque `SEU_EMAIL_AQUI` pelo e-mail do admin e rode.
4. Preencha `config.js` (URL, chave anon e e-mail do admin).

## Subir na Vercel
Envie a pasta para um repositório do GitHub e importe na Vercel (Framework: Other, sem build), ou use `vercel` na pasta.

## Usar o painel
Toque 5 vezes seguidas na logo, digite a senha e use as abas Produtos, Categorias e Textos.

## Logo
`assets/logo.png` foi recortada do print do Instagram e tem baixa resolução. Troque pelo arquivo original (quadrado, de preferência 512x512) mantendo o nome.
