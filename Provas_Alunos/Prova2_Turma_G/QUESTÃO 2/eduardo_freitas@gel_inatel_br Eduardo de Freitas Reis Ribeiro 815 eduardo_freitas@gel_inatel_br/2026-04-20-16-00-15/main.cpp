#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n, count = 0;
    double soma = 0;
    double media =0;
    
    cin >> n;
    
    int v[100];
    
    for(int i = 0; i < n; i++)
    {
        cin >> v[i];
        count++;
        soma += v[i];
    }
    
    media = soma / count;
    
    cout << fixed << setprecision(4);
    cout << media;
    
    
    
    return 0;
}