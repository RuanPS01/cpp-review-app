#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n;
    double altura[100];
    cin >> n;
    
    double menor, maior;
    
    for(int i = 0; i < n; i++)
    {
        cin >> altura[i];
        
        if(i == 0)
        {
            menor = altura[i];
            maior = altura[i];
        }
        
        if(altura[i] > maior)
            maior = altura[i];
        
        if(altura[i] < menor)
            menor = altura[i];
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl;
    
    return 0;
}