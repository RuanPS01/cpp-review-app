#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    //variaveis
    int N;
    int X;
    int soma = 0;
    double media;
    
    //entrada de dados
    cin >> N;
    
    //processamentos
    for (int i = 0; i < N; i++)
    {
        cin >> X;
        soma += X;
        media = (double)soma/N;
    }
    
    cout << fixed << setprecision (4);
    cout << media << endl;
    
    return 0;
}