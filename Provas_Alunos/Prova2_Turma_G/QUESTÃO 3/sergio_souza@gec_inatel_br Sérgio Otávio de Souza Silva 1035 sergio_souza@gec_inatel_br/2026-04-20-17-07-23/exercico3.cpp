#include<iostream>
#include<iomanip>
using namespace std;

int main()
{
    int tempos;
    float soma = 0;
    float media;

    while(tempos == 0){
        cin >> tempos;
        int maior = -999;
        if(tempos > maior){
            tempos = maior;
        }
        soma = soma + tempos;
    }
    media = soma/tempos;
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << tempos  << " minutos" << endl ;
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}