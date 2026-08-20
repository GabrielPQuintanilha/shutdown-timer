# Shutdown Timer

Painel web local para agendar e cancelar o desligamento do computador.

## Como executar no Windows

1. Tenha o Python 3 instalado.
2. Dê dois cliques em `iniciar.bat`.
3. A página será aberta automaticamente no navegador padrão. Se necessário, acesse http://127.0.0.1:8765.

Também é possível executar pelo terminal:

```powershell
python app.py
```

O navegador também será aberto automaticamente ao iniciar pelo terminal.

O painel aceita períodos de 1 minuto a 7 dias. O servidor só escuta em `localhost`, portanto não fica acessível para outros computadores da rede.

> No Linux e macOS, o comando `shutdown` pode solicitar permissões administrativas.
