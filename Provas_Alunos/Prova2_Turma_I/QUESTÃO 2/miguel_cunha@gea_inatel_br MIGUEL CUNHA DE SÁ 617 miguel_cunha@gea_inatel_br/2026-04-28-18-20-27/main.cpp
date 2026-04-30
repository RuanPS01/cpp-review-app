#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    //declaracao de variaveis
    
    int n;//numero de pessoas a serem analisadas
    
    double altura;//altura das pessoas
    
    //variaveis que representam respectivamente a maior e menor altura
    double maiorh = 0;
    double menorh = 0;
    
    //cadastrando pessoas
    cin >> n;
    
    //lendo as alturas
    for(int i = 0; i < n; i++)
    {
        cin >> altura;
        //declarando quem é tem a maior altura e a menor
        if(altura > maiorh)
        {
            maiorh = altura;
            if(altura < menorh && altura < maiorh)
            {
                menorh = altura;
            }
        }        
        
    }
    //manipulando as casas decimais
    cout << fixed << setprecision(2);
    //saida de dados
    cout << "Menor altura: " << menorh << endl;
    cout << "Maior altura: " << maiorh << endl;
    
    return 0;
}